UPDATE "Community" SET "feedPostPrompts" = ARRAY['Share your harvest photos!', 'What are you growing this season?'] WHERE id = 'cmr8ujmhm00043ummhgup5o78';

INSERT INTO "CommunityRule" (id, "communityId", title, description, "order", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid()::text, 'cmr8ujmhm00043ummhgup5o78', 'Be respectful', 'Treat all members with respect.', 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'cmr8ujmhm00043ummhgup5o78', 'No spam', 'Do not post irrelevant content.', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;
