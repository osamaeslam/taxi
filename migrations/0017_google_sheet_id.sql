-- 0017_google_sheet_id.sql: ربط شيت كابتن عز تلقائياً
INSERT OR IGNORE INTO settings (key, value) VALUES ('google_sheet_id', '1GvPC66HjIsy92ASJZ9l-2wIsUFUc4UnXsznqqXlSXv0');
UPDATE settings SET value = '1GvPC66HjIsy92ASJZ9l-2wIsUFUc4UnXsznqqXlSXv0' WHERE key = 'google_sheet_id';

INSERT OR IGNORE INTO settings (key, value) VALUES ('google_sheet_url', 'https://docs.google.com/spreadsheets/d/1GvPC66HjIsy92ASJZ9l-2wIsUFUc4UnXsznqqXlSXv0/edit');
UPDATE settings SET value = 'https://docs.google.com/spreadsheets/d/1GvPC66HjIsy92ASJZ9l-2wIsUFUc4UnXsznqqXlSXv0/edit' WHERE key = 'google_sheet_url';
