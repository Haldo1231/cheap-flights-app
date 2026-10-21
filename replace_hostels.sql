-- Replaces placeholder hostel data with real, researched listings.
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Prices are approximate (Hostelworld doesn't expose live per-night rates to search),
-- shown as "from €X/night" on the site. Ratings are out of 10.

delete from hostels where destination_slug in (
  'rome', 'milan', 'barcelona', 'athens',
  'paris', 'london', 'berlin', 'amsterdam',
  'lisbon', 'warsaw', 'krakow', 'madrid'
);

insert into hostels (name, booking_url, price_per_night, rating, destination_slug) values
('La Controra Hostel Rome', 'https://www.hostelworld.com/hostels/p/46361/la-controra-hostel-rome/', 30, 9.4, 'rome'),
('Palladini Hostel', 'https://www.hostelworld.com/st/hostels/p/72723/palladini-hostel-rome/', 25, 9.4, 'rome'),

('Ostello Bello Grande', 'https://www.hostelworld.com/hostels/p/96190/ostello-bello-grande/', 30, 9.2, 'milan'),
('MEININGER Milano Lambrate', 'https://www.hostelworld.com/br/hostels/p/290186/meininger-milano-lambrate/', 14, 9.0, 'milan'),

('Onefam Paralelo', 'https://www.hostelworld.com/hostels/p/51396/onefam-paralelo/', 25, 9.8, 'barcelona'),
('Sant Jordi Hostels Gràcia', 'https://www.hostelworld.com/hostels/p/60299/sant-jordi-hostels-gracia/', 16, 8.8, 'barcelona'),

('Retroverse Eccentric Stay', 'https://www.hostelworld.com/hostels/p/328636/retroverse-eccentric-stay/', 20, 9.5, 'athens'),
('Athens Backpackers', 'https://www.hostelworld.com/hosteldetails.php/Athens-Backpackers/Athene/6324', 26, 8.5, 'athens'),

('The People Paris Belleville', 'https://www.hostelworld.com/hostels/p/100113/the-people-paris-belleville-ex-les-piaules/', 40, 8.4, 'paris'),
('St Christopher''s Inn Paris - Canal', 'https://www.hostelworld.com/hostels/p/19865/st-christopher-s-inn-paris-canal/', 30, 7.7, 'paris'),

('YHA London St Paul''s', 'https://www.hostelworld.com/hostels/p/6977/yha-london-st-pauls/', 30, 8.4, 'london'),
('Wombat''s City Hostel London', 'https://www.hostelworld.com/hostels/p/88047/wombat-s-city-hostel-london/', 32, 9.1, 'london'),

('EastSeven Berlin Hostel', 'https://www.hostelworld.com/hostels/p/11286/eastseven-berlin-hostel/', 18, 9.6, 'berlin'),
('Sandino - Solo Traveler Sanctuary (seasonal, open May-Sep)', 'https://www.hostelworld.com/hostels/p/51178/sandino-solo-traveler-sanctuary/', 30, 9.8, 'berlin'),

('Stayokay Amsterdam Stadsdoelen', 'https://www.hostelworld.com/hostels/p/4915/stayokay-amsterdam-stadsdoelen/', 35, 8.9, 'amsterdam'),
('ClinkNOORD', 'https://www.hostelworld.com/hostels/p/93919/clinknoord/', 25, 8.2, 'amsterdam'),

('Home Lisbon Hostel', 'https://www.hostelworld.com/hostels/p/15529/home-lisbon-hostel/', 32, 9.7, 'lisbon'),
('Goodmorning Solo Traveller Hostel', 'https://www.hostelworld.com/hostels/p/59901/goodmorning-solo-traveller-hostel/', 35, 9.9, 'lisbon'),

('Oki Doki Old Town Hostel', 'https://www.hostelworld.com/hostels/p/277933/oki-doki-old-town-hostel-warsaw/', 20, 9.4, 'warsaw'),
('Old Town Kanonia Hostel and Apartments', 'https://www.hostelworld.com/hostels/p/15354/old-town-kanonia-hostel-and-apartments/', 22, 9.4, 'warsaw'),

('Greg & Tom Hostel', 'https://www.hostelworld.com/hostels/p/7327/greg-and-tom-hostel/', 18, 9.5, 'krakow'),
('Greg&Tom City Hostel', 'https://www.hostelworld.com/hostels/p/35593/greg-and-tom-city-hostel/', 20, 9.1, 'krakow'),

('Onefam Sungate', 'https://www.hostelworld.com/hostels/p/90911/onefam-sungate/', 30, 9.3, 'madrid'),
('Cat''s Hostel Madrid Sol', 'https://www.hostelworld.com/hostels/p/6657/cats-hostel-madrid-sol/', 25, 9.0, 'madrid');
