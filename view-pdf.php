<?php
$file = isset($_GET['file']) ? $_GET['file'] : '';
$file = urldecode($file);
$file = basename($file);
$file_path = 'pdf/' . $file;

if(file_exists($file_path) && strtolower(pathinfo($file_path, PATHINFO_EXTENSION)) == 'pdf') {
    // Открываем файл через PHP с правильными заголовками
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . basename($file_path) . '"');
    header('Content-Transfer-Encoding: binary');
    header('Accept-Ranges: bytes');
    readfile($file_path);
    exit;
} else {
    header('HTTP/1.0 404 Not Found');
    echo "Файл не найден";
}
?>
