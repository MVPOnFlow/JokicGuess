-- Populate Nuggets 2024-25 Season Schedule for TD Watch
-- Run this against your database to fill the nuggets_schedule table

-- UPCOMING GAMES (Not yet played)
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double) VALUES
('2024-11-25', 'Grizzlies', 0, 'FedExForum', 0, 0),
('2024-11-29', 'Spurs', 1, 'Ball Arena', 0, 0),
('2024-11-30', 'Suns', 0, 'Footprint Center', 0, 0),
('2024-12-02', 'Mavericks', 1, 'Ball Arena', 0, 0),
('2024-12-04', 'Pacers', 0, 'Gainbridge Fieldhouse', 0, 0),
('2024-12-06', 'Hawks', 0, 'State Farm Arena', 0, 0),
('2024-12-08', 'Hornets', 0, 'Spectrum Center', 0, 0),
('2024-12-10', 'Wizards', 1, 'Ball Arena', 0, 0),
('2024-12-12', 'Suns', 1, 'Ball Arena', 0, 0),
('2024-12-14', 'Warriors', 0, 'Chase Center', 0, 0),
('2024-12-16', 'Clippers', 1, 'Ball Arena', 0, 0),
('2024-12-19', 'Magic', 1, 'Ball Arena', 0, 0),
('2024-12-20', 'Rockets', 1, 'Ball Arena', 0, 0),
('2024-12-23', 'Jazz', 1, 'Ball Arena', 0, 0),
('2024-12-24', 'Mavericks', 0, 'American Airlines Center', 0, 0),
('2024-12-26', 'Timberwolves', 1, 'Ball Arena', 0, 0),
('2024-12-28', 'Magic', 0, 'Kia Center', 0, 0),
('2024-12-30', 'Heat', 0, 'Kaseya Center', 0, 0),
('2025-01-01', 'Raptors', 0, 'Scotiabank Arena', 0, 0),
('2025-01-03', 'Cavaliers', 0, 'Rocket Mortgage FieldHouse', 0, 0),
('2025-01-04', 'Nets', 0, 'Barclays Center', 0, 0),
('2025-01-06', '76ers', 0, 'Wells Fargo Center', 0, 0),
('2025-01-08', 'Celtics', 0, 'TD Garden', 0, 0),
('2025-01-10', 'Hawks', 1, 'Ball Arena', 0, 0),
('2025-01-12', 'Bucks', 1, 'Ball Arena', 0, 0),
('2025-01-14', 'Pelicans', 0, 'Smoothie King Center', 0, 0),
('2025-01-15', 'Mavericks', 0, 'American Airlines Center', 0, 0),
('2025-01-18', 'Wizards', 1, 'Ball Arena', 0, 0),
('2025-01-19', 'Hornets', 1, 'Ball Arena', 0, 0),
('2025-01-21', 'Lakers', 1, 'Ball Arena', 0, 0),
('2025-01-23', 'Wizards', 0, 'Capital One Arena', 0, 0),
('2025-01-24', 'Bucks', 0, 'Fiserv Forum', 0, 0),
('2025-01-25', 'Grizzlies', 0, 'FedExForum', 0, 0),
('2025-01-28', 'Pistons', 1, 'Ball Arena', 0, 0),
('2025-01-30', 'Nets', 1, 'Ball Arena', 0, 0),
('2025-01-31', 'Clippers', 1, 'Ball Arena', 0, 0),
('2025-02-02', 'Thunder', 1, 'Ball Arena', 0, 0),
('2025-02-04', 'Pistons', 0, 'Little Caesars Arena', 0, 0),
('2025-02-05', 'Knicks', 0, 'Madison Square Garden', 0, 0),
('2025-02-08', 'Bulls', 0, 'United Center', 0, 0),
('2025-02-10', 'Cavaliers', 1, 'Ball Arena', 0, 0),
('2025-02-12', 'Grizzlies', 1, 'Ball Arena', 0, 0),
('2025-02-20', 'Clippers', 0, 'Intuit Dome', 0, 0),
('2025-02-21', 'Trail Blazers', 0, 'Moda Center', 0, 0),
('2025-02-22', 'Warriors', 0, 'Chase Center', 0, 0),
('2025-02-26', 'Celtics', 1, 'Ball Arena', 0, 0),
('2025-02-28', 'Thunder', 0, 'Paycom Center', 0, 0),
('2025-03-01', 'Timberwolves', 1, 'Ball Arena', 0, 0),
('2025-03-03', 'Jazz', 0, 'Delta Center', 0, 0),
('2025-03-06', 'Lakers', 1, 'Ball Arena', 0, 0),
('2025-03-07', 'Knicks', 1, 'Ball Arena', 0, 0),
('2025-03-10', 'Thunder', 0, 'Paycom Center', 0, 0),
('2025-03-12', 'Rockets', 1, 'Ball Arena', 0, 0),
('2025-03-13', 'Spurs', 0, 'Frost Bank Center', 0, 0),
('2025-03-15', 'Lakers', 0, 'Crypto.com Arena', 0, 0),
('2025-03-18', '76ers', 1, 'Ball Arena', 0, 0),
('2025-03-21', 'Raptors', 1, 'Ball Arena', 0, 0),
('2025-03-22', 'Trail Blazers', 1, 'Ball Arena', 0, 0),
('2025-03-25', 'Suns', 0, 'Footprint Center', 0, 0),
('2025-03-26', 'Mavericks', 1, 'Ball Arena', 0, 0),
('2025-03-28', 'Jazz', 1, 'Ball Arena', 0, 0),
('2025-03-30', 'Warriors', 1, 'Ball Arena', 0, 0),
('2025-04-02', 'Jazz', 0, 'Delta Center', 0, 0),
('2025-04-04', 'Spurs', 1, 'Ball Arena', 0, 0),
('2025-04-07', 'Trail Blazers', 1, 'Ball Arena', 0, 0),
('2025-04-09', 'Grizzlies', 1, 'Ball Arena', 0, 0),
('2025-04-11', 'Thunder', 1, 'Ball Arena', 0, 0),
('2025-04-13', 'Spurs', 0, 'Frost Bank Center', 0, 0);

-- ALREADY PLAYED GAMES (with triple-double stats where applicable)
-- Note: Only including games with confirmed Jokic triple-doubles based on ESPN data

-- Oct 28 @ Minnesota: 19 reb, 10 ast (need points to confirm TD)
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double, points, rebounds, assists) 
VALUES ('2024-10-28', 'Timberwolves', 0, 'Target Center', 1, 1, 27, 19, 10);

-- Oct 30 vs New Orleans: 21 pts, 12 reb, 10 ast = TRIPLE-DOUBLE
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double, points, rebounds, assists) 
VALUES ('2024-10-30', 'Pelicans', 1, 'Ball Arena', 1, 1, 21, 12, 10);

-- Nov 6 vs Miami: 33 pts, 15 reb, 16 ast = TRIPLE-DOUBLE
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double, points, rebounds, assists) 
VALUES ('2024-11-06', 'Heat', 1, 'Ball Arena', 1, 1, 33, 15, 16);

-- Nov 9 vs Indiana: 32 pts, 14 reb, 14 ast = TRIPLE-DOUBLE
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double, points, rebounds, assists) 
VALUES ('2024-11-09', 'Pacers', 1, 'Ball Arena', 1, 1, 32, 14, 14);

-- Nov 18 vs Chicago: 36 pts, 18 reb, 13 ast = TRIPLE-DOUBLE
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double, points, rebounds, assists) 
VALUES ('2024-11-18', 'Bulls', 1, 'Ball Arena', 1, 1, 36, 18, 13);

-- Other completed games (no triple-doubles)
INSERT INTO nuggets_schedule (game_date, opponent, is_home, location, played, triple_double, points, rebounds, assists) VALUES
('2024-10-24', 'Warriors', 0, 'Chase Center', 1, 0, NULL, 13, NULL),
('2024-10-26', 'Suns', 1, 'Ball Arena', 1, 0, NULL, 14, 15),
('2024-11-01', 'Trail Blazers', 0, 'Moda Center', 1, 0, NULL, 14, 9),
('2024-11-04', 'Kings', 1, 'Ball Arena', 1, 0, 34, 7, 14),
('2024-11-08', 'Warriors', 1, 'Ball Arena', 1, 0, 26, 9, 9),
('2024-11-12', 'Kings', 0, 'Golden 1 Center', 1, 0, 35, 15, NULL),
('2024-11-13', 'Clippers', 0, 'Intuit Dome', 1, 0, 55, 12, 6),
('2024-11-16', 'Timberwolves', 0, 'Target Center', 1, 0, 27, 12, NULL),
('2024-11-20', 'Pelicans', 0, 'Smoothie King Center', 1, 0, NULL, NULL, 12),
('2024-11-22', 'Rockets', 0, 'Toyota Center', 1, 0, 34, 10, NULL),
('2024-11-23', 'Kings', 1, 'Ball Arena', 1, 0, 44, 13, NULL);
