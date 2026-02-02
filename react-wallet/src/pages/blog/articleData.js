// Central article data configuration
export const articles = [
  {
    id: 'okc-game-analysis',
    title: 'Thunder Silence Nuggets Behind SGA\'s 34 Points',
    author: '$MVP Team',
    date: '2026-02-01',
    category: 'Game Analysis',
    excerpt: 'Oklahoma City cruises to 121-111 victory as Shai Gilgeous-Alexander and Cason Wallace dominate from three-point range in championship rematch.',
    image: '/images/okc-game.jpg',
    route: '/blog/okc-game-analysis',
    featured: true
  },
  {
    id: 'triple-double-chase',
    title: 'Triple-Double Chase: Jokić Reaches 3rd All-Time',
    author: '$MVP Team',
    date: '2026-01-28',
    category: 'Career Milestone',
    excerpt: 'With 180 career triple-doubles, Nikola Jokić surpasses Magic Johnson for 3rd all-time, just one behind Oscar Robertson. Breaking down his historic chase.',
    image: '/images/td-tracker.jpg',
    route: '/blog/triple-double-chase'
  }
];

export const getCategoryColor = (category) => {
  const colors = {
    'Game Analysis': 'primary',
    'Career Milestone': 'primary',
    'Advanced Analytics': 'success',
    'Analysis': 'info',
    'Deep Dive': 'success',
    'News': 'warning'
  };
  return colors[category] || 'primary';
};

export const getArticleById = (id) => {
  return articles.find(article => article.id === id);
};

export const getFeaturedArticle = () => {
  return articles.find(article => article.featured) || articles[0];
};

export const getRelatedArticles = (currentId, limit = 2) => {
  return articles.filter(article => article.id !== currentId).slice(0, limit);
};
