-- Task evidence: allow short video clips (screen recordings) alongside
-- images, and raise the bucket cap to fit them (client-side still enforces
-- a stricter 5MB image / 25MB video split — see lib/panel/task-comments.ts).

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
where id = 'panel-task-evidence';
