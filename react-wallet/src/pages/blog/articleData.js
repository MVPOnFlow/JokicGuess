// Central article data configuration
export const articles = [
  {
    id: 'jokic-passes-oscar',
    title: 'The Big O Dethroned: Jokić Surpasses Oscar Robertson for 2nd All-Time in Triple-Doubles',
    author: '$MVP Team',
    date: '2026-02-12',
    category: 'Career Milestone',
    excerpt: 'With his 183rd career triple-double, Nikola Jokić has officially moved past Oscar Robertson into sole possession of second place on the NBA\'s all-time list. A lookback on the milestones, the legend he passed, and the record still ahead.',
    image: '/images/td-tracker.jpg',
    route: '/blog/jokic-passes-oscar',
    featured: true
  },
  {
    id: 'okc-game-feb-01-2026',
    title: 'Thunder Silence Nuggets Behind SGA\'s 34 Points',
    author: '$MVP Team',
    date: '2026-02-01',
    category: 'Game Analysis',
    excerpt: 'Oklahoma City cruises to 121-111 victory as Shai Gilgeous-Alexander and Cason Wallace dominate from three-point range in championship rematch.',
    image: '/images/okc-game.jpg',
    route: '/blog/okc-game-feb-01-2026'
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
  },
  {
    id: 'flow-security-incident',
    title: 'Rising from Adversity: Flow\'s Masterclass in Crisis Response',
    author: '$MVP Team',
    date: '2026-01-30',
    category: 'Blockchain',
    excerpt: 'When a security breach hit Flow blockchain on December 27, 2025, the team\'s swift action and transparent communication showcased why resilience matters more than perfection in Web3.',
    image: '/images/flow-blockchain.jpg',
    route: '/blog/flow-security-incident'
  }
];

export const getCategoryColor = (category) => {
  const colors = {
    'Game Analysis': 'primary',
    'Career Milestone': 'primary',
    'Advanced Analytics': 'success',
    'Analysis': 'info',
    'Deep Dive': 'success',
    'News': 'warning',
    'Blockchain': 'info'
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
