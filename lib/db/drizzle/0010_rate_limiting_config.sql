-- Insert default rate limiting configurations for all user interactions
-- Authentication rate limiters
INSERT INTO "site_config" ("key", "value") VALUES 
('rateLimitLoginPerWindow', '5'),
('rateLimitLoginWindowMs', '900000'),
('rateLimitRegisterPerWindow', '3'),
('rateLimitRegisterWindowMs', '3600000'),
('rateLimitForgotPasswordPerWindow', '3'),
('rateLimitForgotPasswordWindowMs', '3600000'),
('rateLimitResetPasswordPerWindow', '5'),
('rateLimitResetPasswordWindowMs', '3600000'),
('rateLimitSsoLinkPerWindow', '10'),
('rateLimitSsoLinkWindowMs', '900000'),
('rateLimitInviteRequestPerWindow', '3'),
('rateLimitInviteRequestWindowMs', '86400000'),
('rateLimitApiPerWindow', '100'),
('rateLimitApiWindowMs', '60000'),
-- Forum interaction rate limiters
('rateLimitCreateThreadPerWindow', '5'),
('rateLimitCreateThreadWindowMs', '3600000'),
('rateLimitCreatePostPerWindow', '10'),
('rateLimitCreatePostWindowMs', '300000'),
('rateLimitEditPostPerWindow', '20'),
('rateLimitEditPostWindowMs', '3600000'),
('rateLimitDeletePostPerWindow', '10'),
('rateLimitDeletePostWindowMs', '3600000'),
-- Profile interaction rate limiters
('rateLimitProfilePostPerWindow', '5'),
('rateLimitProfilePostWindowMs', '600000'),
('rateLimitEditProfilePostPerWindow', '10'),
('rateLimitEditProfilePostWindowMs', '3600000'),
('rateLimitDeleteProfilePostPerWindow', '10'),
('rateLimitDeleteProfilePostWindowMs', '3600000'),
-- File upload rate limiters
('rateLimitFileUploadPerWindow', '5'),
('rateLimitFileUploadWindowMs', '600000'),
('rateLimitAvatarUploadPerWindow', '3'),
('rateLimitAvatarUploadWindowMs', '3600000'),
-- Shoutbox rate limiting
('shoutboxRateLimitPerWindow', '5'),
('shoutboxRateLimitWindowMs', '10000'),
('shoutboxRateLimitStrikeDecayMs', '3600000'),
('shoutboxRateLimitMaxStrikes', '3'),
('shoutboxMaxMessages', '50'),
('shoutboxMaxCharacters', '500'),
-- Verification and misc rate limiters
('rateLimitVerifyEmailPerWindow', '3'),
('rateLimitVerifyEmailWindowMs', '3600000'),
('rateLimitPurchasePerWindow', '10'),
('rateLimitPurchaseWindowMs', '3600000')
ON CONFLICT ("key") DO NOTHING;
