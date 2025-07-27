const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');

// Route to search for learning resources
// GET /api/resources?query=keyword&limit=5&lang=en
router.get('/', resourceController.searchResources);

// Route to get detailed information about specific videos
// POST /api/resources/details
router.post('/details', resourceController.getResourceDetails);

module.exports = router;