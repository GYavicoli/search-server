const { getJson } = require('serpapi');

class Service { 
    constructor() {
        this.apiKey = process.env.SERPAPI_KEY;
    }

    async search(q, location) {
        try {
            const response = await getJson('google', {
                api_key: this.apiKey,
                q: q,
                location: location
            });
            return response || 'No results found.';

        } catch (error) {
            return 'Error fetching data.';

        } finally {
            console.log(`${q} fetch completed.`);
        }
    }
}

module.exports = Service;