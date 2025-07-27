const youtubeService = require('../services/youtubeService');

class ResourceController {
  async searchResources(req, res) {
    try {
      const { query, limit = 5, lang = 'en' } = req.query;

      // Validate required query parameter
      if (!query || query.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required',
          message: 'Please provide a search keyword using ?query=keyword'
        });
      }

      // Enhance query for educational content
      const enhancedQuery = `${query.trim()} tutorial learning education`;

      // Search YouTube videos
      const videos = await youtubeService.searchVideos(enhancedQuery, parseInt(limit));

      // Return successful response
      res.status(200).json({
        success: true,
        data: {
          query: query.trim(),
          totalResults: videos.length,
          videos: videos
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in searchResources:', error.message);
      
      // Handle different types of errors
      if (error.message.includes('quota')) {
        return res.status(429).json({
          success: false,
          error: 'API quota exceeded',
          message: 'YouTube API quota has been exceeded. Please try again later.'
        });
      }

      if (error.message.includes('API key')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'YouTube API key is invalid or missing'
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch learning resources'
      });
    }
  }

  async getResourceDetails(req, res) {
    try {
      const { videoIds } = req.body;

      if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Video IDs are required',
          message: 'Please provide an array of video IDs'
        });
      }

      const videoDetails = await youtubeService.getVideoDetails(videoIds);

      res.status(200).json({
        success: true,
        data: {
          videos: videoDetails
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in getResourceDetails:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch video details'
      });
    }
  }
}

module.exports = new ResourceController();