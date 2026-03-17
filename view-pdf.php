<?php
$file = isset($_GET['file']) ? $_GET['file'] : '';
// Защита от взлома - разрешаем только PDF файлы из папки /pdf/
$file = basename($file); // убираем пути
$file_path = 'pdf/' . $file; // папка с PDF файлами

if(file_exists($file_path) && pathinfo($file_path, PATHINFO_EXTENSION) == 'pdf') {
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Просмотр PDF: <?php echo htmlspecialchars($file); ?></title>
        <meta charset="utf-8">
        <style>
            body, html {
                margin: 0;
                padding: 0;
                height: 100%;
                overflow: hidden;
            }
            .pdf-viewer {
                width: 100%;
                height: 100vh;
                border: none;
            }
        </style>
    </head>
    <body>
        <iframe src="<?php echo $file_path; ?>" class="pdf-viewer"></iframe>
    </body>
    </html>
    <?php
} else {
    echo "Файл не найден или не является PDF";
}
?>
