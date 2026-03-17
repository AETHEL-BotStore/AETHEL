<?php
$file = isset($_GET['file']) ? $_GET['file'] : '';
$file = urldecode($file);
$file = basename($file);
$file_url = 'https://www.aethelbotstore.ru/pdf/' . urlencode($file);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Просмотр PDF</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <iframe src="https://docs.google.com/viewer?url=<?php echo urlencode($file_url); ?>&embedded=true"></iframe>
</body>
</html>
