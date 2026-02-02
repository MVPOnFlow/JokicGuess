# Blog Structure Documentation

## Overview
The blog system is organized in `/pages/blog/` to keep article components separate from main app pages.

## Writing Guidelines

### Style Rules
- **Never use em dashes (—)**: They make content look AI-generated. Use commas, semicolons, colons, or periods instead.
- **Never use "JokicGuess"**: Always refer to the community as "$MVP" or "$MVP community"
- Keep tone professional but accessible
- Use real data and verified sources only
- No fabricated quotes - only include quotes from verified sources

### Content Standards
- All game statistics must be accurate and sourced
- No speculation or made-up information
- Use dark theme colors consistently (#121826 background, #FDB927 gold, #E5E7EB text)
- All tables and cards must have readable text on dark backgrounds

## File Structure
```
pages/blog/
├── Blog.css              # Shared styles for all blog pages
├── articleData.js        # Centralized article configuration
├── BlogList.jsx          # Main blog listing page (/blog)
├── OKCGameAnalysis.jsx   # OKC game analysis article
├── TripleDoubleChase.jsx # Triple-double milestone article
└── DefensiveImpact.jsx   # Defensive analytics article
```

## Key Components

### articleData.js
Central configuration file containing:
- Article metadata (title, date, author, category, excerpt)
- Helper functions:
  - `getCategoryColor()` - Returns Bootstrap badge color for categories
  - `getArticleById()` - Retrieves specific article by ID
  - `getFeaturedArticle()` - Gets the featured article
  - `getRelatedArticles()` - Gets related articles for cross-linking

### BlogList.jsx
Main blog landing page showing:
- Hero section with blog description
- Featured article (full-width card)
- Article grid (remaining articles)
- Newsletter signup section

### Article Pages
Each article includes:
- Article header with badge, title, and metadata
- Featured image section
- Main content with proper typography
- Stat boxes and data visualizations
- Related articles sidebar
- Sticky navigation sidebar (desktop)

## Color Contrast Improvements
All gradients and backgrounds updated to use darker, higher-contrast colors:
- Primary gradient: `#2c5282` to `#1a365d` (instead of `#418FDE` to `#0E2240`)
- Better text readability on all colored backgrounds
- Accessible badge colors

## Adding New Articles

### Step 1: Add to articleData.js
```javascript
{
  id: 'new-article-slug',
  title: 'Article Title',
  author: 'JokicGuess Team',
  date: '2026-02-15',
  category: 'Analysis',
  excerpt: 'Brief description...',
  featured: false
}
```

### Step 2: Create Article Component
Create `NewArticle.jsx` in `/pages/blog/` following the structure of existing articles.

### Step 3: Add Route
Update `App.jsx`:
```javascript
import NewArticle from "./pages/blog/NewArticle";
// ...
<Route path="blog/new-article-slug" element={<NewArticle />} />
```

### Step 4: Use Related Articles
In your article component:
```javascript
import { getRelatedArticles } from './articleData';
const relatedArticles = getRelatedArticles('new-article-slug');
```

## Categories & Colors
- **Game Analysis**: Primary (blue)
- **Career Milestone**: Primary (blue)  
- **Advanced Analytics**: Success (green)
- **Deep Dive**: Secondary (gray)
- **News**: Success (green)

## Best Practices
1. All blog files stay in `/pages/blog/` folder
2. Use centralized `articleData.js` for article metadata
3. Ensure color contrast meets accessibility standards
4. Add related articles to create cross-linking
5. Update featured article flag in `articleData.js` as needed
6. Keep article IDs URL-friendly (lowercase, hyphens)

## Maintenance
- Update `articleData.js` when adding/removing articles
- Ensure all article routes are registered in `App.jsx`
- Keep Blog.css organized with clear section comments
- Test responsive design on mobile and desktop
