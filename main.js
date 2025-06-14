const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios');

app.use(cors());
app.use(express.json());

app.get('/download', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send({ error: 'No URL provided' });

    try {
        const response = await axios.get(`https://api.reelsaver.app/api/download?url=${url}`);
        res.send(response.data);
    } catch (err) {
        res.status(500).send({ error: 'Failed to download video' });
    }
});

app.listen(3000, () => console.log('Insta API running on port 3000'));
