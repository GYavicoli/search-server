require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const port = 5001;
const service = require('./Service.js');
const instance = new service();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173' // Allow requests from your frontend
}));

app.post('/api/search', async (req, res) => {
    const { q, location } = req.body;
    const result = await instance.search(q, location);
    res.json(result);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});