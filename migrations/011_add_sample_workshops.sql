-- Add 3 sample workshops with complete information

-- Workshop 1: Atelier Tournage Initiation
INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
VALUES (
  'Atelier Tournage Initiation',
  'Découvrez l''art du tournage de poterie dans cet atelier d''initiation. Apprenez les techniques de base pour centrer l''argile, créer des formes symétriques et réaliser vos premières pièces. Matériel et argile fournis, cuisson incluse. Parfait pour les débutants qui souhaitent découvrir la céramique.',
  'débutant',
  150, -- 2h30
  50.00,
  '/ceramic-pottery-workshop-hands-creating-clay-potte.jpg',
  'active',
  4
) ON CONFLICT DO NOTHING;

-- Workshop 2: Atelier Modelage Créatif
INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
VALUES (
  'Atelier Modelage Créatif',
  'Libérez votre créativité avec le modelage à la main. Explorez différentes techniques : colombin, plaque, estampage. Créez des pièces uniques et personnalisées selon vos envies. Cet atelier convient aux débutants comme aux personnes ayant déjà une expérience. Accompagnement personnalisé par nos céramistes.',
  'intermédiaire',
  180, -- 3h00
  75.00,
  '/artisan-coffee-cafe-with-ceramic-pottery-handmade-.jpg',
  'active',
  4
) ON CONFLICT DO NOTHING;

-- Workshop 3: Atelier Émaillage & Finitions
INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
VALUES (
  'Atelier Émaillage & Finitions',
  'Apprenez l''art de l''émaillage pour donner vie et couleur à vos créations céramiques. Découvrez notre palette variée d''émaux, les techniques d''application et les effets possibles. Cet atelier est idéal pour ceux qui souhaitent finaliser leurs pièces avec des finitions professionnelles. Vous pouvez apporter vos propres pièces biscuitées ou utiliser celles de l''atelier.',
  'avancé',
  120, -- 2h00
  65.00,
  '/boutique/tasse-artisanale.jpg',
  'active',
  6
) ON CONFLICT DO NOTHING;

-- Add sessions for Workshop 1 (Tournage Initiation)
INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '7 days',
  '10:00:00',
  4,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Tournage Initiation'
LIMIT 1;

INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '14 days',
  '14:00:00',
  4,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Tournage Initiation'
LIMIT 1;

INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '21 days',
  '18:00:00',
  4,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Tournage Initiation'
LIMIT 1;

-- Add sessions for Workshop 2 (Modelage Créatif)
INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '8 days',
  '10:00:00',
  4,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Modelage Créatif'
LIMIT 1;

INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '15 days',
  '14:00:00',
  4,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Modelage Créatif'
LIMIT 1;

INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '22 days',
  '18:00:00',
  4,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Modelage Créatif'
LIMIT 1;

-- Add sessions for Workshop 3 (Émaillage & Finitions)
INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '9 days',
  '10:00:00',
  6,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Émaillage & Finitions'
LIMIT 1;

INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '16 days',
  '14:00:00',
  6,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Émaillage & Finitions'
LIMIT 1;

INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
SELECT 
  w.id,
  CURRENT_DATE + INTERVAL '23 days',
  '18:00:00',
  6,
  0,
  'active'
FROM workshops w
WHERE w.title = 'Atelier Émaillage & Finitions'
LIMIT 1;


