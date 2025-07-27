const { google } = require('googleapis');

class YouTubeService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  async searchVideos(query, maxResults = 5) {
    try {
      const response = await this.youtube.search.list({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: maxResults,
        order: 'relevance',
        safeSearch: 'strict',
        // Filter for educational content
        videoCategory: '27', // Education category
        relevanceLanguage: 'en' // Can be modified for multilingual support
      });

      return response.data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: {
          default: item.snippet.thumbnails.default?.url,
          medium: item.snippet.thumbnails.medium?.url,
          high: item.snippet.thumbnails.high?.url
        },
        videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }));
    } catch (error) {
      console.error('YouTube API Error:', error.message);
      throw new Error('Failed to fetch YouTube videos');
    }
  }

  async getVideoDetails(videoIds) {
    try {
      const response = await this.youtube.videos.list({
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(',')
      });

      return response.data.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        duration: item.contentDetails.duration,
        viewCount: item.statistics.viewCount,
        likeCount: item.statistics.likeCount,
        thumbnail: item.snippet.thumbnails.medium?.url,
        videoUrl: `https://www.youtube.com/watch?v=${item.id}`,
        channelTitle: item.snippet.channelTitle
      }));
    } catch (error) {
      console.error('YouTube API Error:', error.message);
      throw new Error('Failed to fetch video details');
    }
  }
}

module.exports = new YouTubeService();