require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.SERVER_PORT || 5001;
const service = require('./Service.js');
const instance = new service();

app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT || 'http://localhost:5173'
}));

app.post('/api/search', async (req, res) => {
    const { q, location } = req.body;
    const result = await instance.search(q, location);
    res.json(result);
});

app.listen(port, () => {
    console.log(`Server is running on:${port}`);
});