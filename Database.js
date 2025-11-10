class Database {
  constructor(options = {}) {
    const {
      host = process.env.PGHOST || 'localhost',
      port = process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      user = process.env.PGUSER || 'postgres',
      password = process.env.PGPASSWORD || '',
      database = process.env.PGDATABASE || 'postgres',
      connectionTimeoutMillis = 5000,
    } = options;

    this.config = { host, port, user, password, database, connectionTimeoutMillis };
    this.client = null;
    this._connected = false;
  }

  async connect() {
    if (this._connected) return;
    const { Client } = require('pg');
    this.client = new Client(this.config);
    await this.client.connect();
    this._connected = true;
  }

  // Gracefully close connection
  async disconnect() {
    if (!this._connected || !this.client) return;
    await this.client.end();
    this._connected = false;
    this.client = null;
  }

  async query(text, params) {
    if (!this._connected) await this.connect();
    return this.client.query(text, params);
  }

  async withClient(fn) {
    if (!this._connected) await this.connect();
    try {
      return await fn(this.client);
    } finally {
      // do not disconnect automatically here by default; caller controls lifecycle
    }
  }

  /**
   * Store (insert or update) a user record.
   * - Ensures the `users` table exists with `id` as primary key.
   * - Uses parameterized queries to avoid injection.
   * @param {string} id
   * @param {string} name 
   * @returns {Promise<object>}
   */
  async storeUser(id, name) {
    if (!id || !name) {
      throw new Error('storeUser requires both id and name');
    }

    if (!this._connected) await this.connect();

    const createSql = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`;
    await this.client.query(createSql);

    const upsertSql = `
      INSERT INTO users (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `;

    const res = await this.client.query(upsertSql, [String(id), String(name)]);
    return res.rows[0];
  }

  /**
   * Add or update a user's favorite location.
   * - Ensures the `favorites` table exists with a UNIQUE(user_id, location_id) constraint.
   * - Inserts a favorite (user_id, location_id) or updates the timestamp if it already exists.
   * @param {string} userId
   * @param {string} locationId
   * @returns {Promise<object>}
   */
  async addUserFavorite(userId, locationId) {
    if (!userId || !locationId) {
      throw new Error('addUserFavorite requires both userId and locationId');
    }

    if (!this._connected) await this.connect();

    const createUsers = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`;
    await this.client.query(createUsers);

    const createFavs = `
      CREATE TABLE IF NOT EXISTS favorites (
        user_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (user_id, location_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`;
    try {
      await this.client.query(createFavs);
    } catch (err) {
      const createFavsNoFK = `
        CREATE TABLE IF NOT EXISTS favorites (
          user_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE (user_id, location_id)
        )`;
      await this.client.query(createFavsNoFK);
    }

    const upsertFav = `
      INSERT INTO favorites (user_id, location_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, location_id) DO UPDATE SET created_at = EXCLUDED.created_at
      RETURNING user_id, location_id, created_at
    `;

    const res = await this.client.query(upsertFav, [String(userId), String(locationId)]);
    return res.rows[0];
  }

  /**
   * Remove a user's favorite location by locationId.
   * @param {string} userId 
   * @param {string} locationId 
   * @returns {Promise<object|null>} 
   */
  async removeUserFavorite(userId, locationId) {
    if (!userId || !locationId) {
      throw new Error('removeUserFavorite requires both userId and locationId');
    }

    if (!this._connected) await this.connect();

    const delSql = `
      DELETE FROM favorites
      WHERE user_id = $1 AND location_id = $2
      RETURNING user_id, location_id, created_at
    `;

    const res = await this.client.query(delSql, [String(userId), String(locationId)]);
    return res.rows[0] || null;
  }

  /**
   * Add a new location record if it doesn't already exist.
   * - Ensures the `locations` table exists with required columns.
   * - Uses parameterized queries for safety.
   * - Only inserts if the location ID doesn't exist (preserves existing locations).
   * @param {object} location 
   * @param {string} location.id 
   * @param {string} location.name 
   * @param {string} location.category 
   * @param {string} location.thumbnail 
   * @param {string} location.website 
   * @param {string} location.description 
   * @param {[number, number]} location.latlng 
   * @returns {Promise<object|null>} The new location if inserted, null if already exists
   */
  async storeLocation({ id, name, category, thumbnail, website, description, latlng }) {
    if (!id || !name || !category || !Array.isArray(latlng) || latlng.length !== 2) {
      throw new Error('storeLocation requires id, name, category, and latlng[2]');
    }

    if (!this._connected) await this.connect();

    const createTable = `
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        thumbnail TEXT,
        website TEXT,
        description TEXT,
        latlng DOUBLE PRECISION[2],
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`;
    await this.client.query(createTable);

    const insertLocation = `
      INSERT INTO locations (
        id, name, category, thumbnail, website, description, latlng
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `;

    const values = [
      String(id),
      String(name),
      String(category),
      thumbnail ? String(thumbnail) : null,
      website ? String(website) : null,
      description ? String(description) : null,
      latlng
    ];

    const res = await this.client.query(upsertLocation, values);
    return res.rows[0];
  }

  /**
   * Get all locations in a category.
   * @param {string} category Category to filter by
   * @param {boolean} [ascending=true] Sort in ascending order by name if true
   * @returns {Promise<Array<object>>} Array of location objects
   */
  async getLocationsByCategory(category, ascending = true) {
    if (!category) {
      throw new Error('getLocationsByCategory requires category parameter');
    }

    if (!this._connected) await this.connect();

    const query = `
      SELECT *
      FROM locations
      WHERE category = $1
      ORDER BY name ${ascending ? 'ASC' : 'DESC'}
    `;

    const res = await this.client.query(query, [String(category)]);

    return res.rows;
  }

  /**
   * Get all locations that a user has favorited.
   * @param {string} userId The user's ID to get favorites for
   * @returns {Promise<Array<object>>} Array of location objects with favorite metadata
   */
  async getUserFavoriteLocations(userId) {
    if (!userId) {
      throw new Error('getUserFavoriteLocations requires userId parameter');
    }

    if (!this._connected) await this.connect();

    const query = `
      SELECT 
        l.*,
        f.created_at as saved_at
      FROM favorites f
      JOIN locations l ON f.location_id = l.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `;

    const res = await this.client.query(query, [String(userId)]);

    return res.rows;
  }
}

module.exports = Database;
