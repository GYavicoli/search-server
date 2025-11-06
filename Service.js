const { getJson } = require('serpapi');

class Service { 
    constructor() {}

    async search(q, location) {
        // ToDo - move api key to env variable or someplace safer
        const apiKey = 'bedee3a120f828213c1bd9148dfd4b0e26c5318a096b4fe25a1df4cc4203cb6b';

        try {
            const response = await getJson('google', {
                api_key: apiKey,
                q: q,
                location: location
            });
            return response || 'No results found.';

        } catch (error) {
            return 'Error fetching data.';

        } finally {
            console.log('fetchData completed');
        }
    }
}

module.exports = Service;