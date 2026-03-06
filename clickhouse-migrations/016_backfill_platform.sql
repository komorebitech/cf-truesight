ALTER TABLE truesight.events
UPDATE platform = multiIf(
    lower(os_name) = 'web', 'web',
    lower(os_name) = 'android', 'android',
    lower(os_name) = 'ios', 'ios',
    lower(os_name) IN ('macos', 'mac os', 'mac os x'), 'macos',
    lower(os_name) = 'windows', 'windows',
    lower(os_name) = 'linux', 'linux',
    'unknown'
)
WHERE platform = '';
