<?php
$file = isset($_GET['file']) ? $_GET['file'] : '';
$file = urldecode($file);
$file = basename($file);
$file_path = 'pdf/' . $file;

if(file_exists($file_path) && strtolower(pathinfo($file_path, PATHINFO_EXTENSION)) == 'pdf') {
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
                background: #f0f0f0;
            }
            .pdf-viewer {
                width: 100%;
                height: 100vh;
                border: none;
                display: block;
            }
            .fallback {
                display: none;
                text-align: center;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <!-- Способ 1: Embed (наиболее надежный для просмотра) -->
        <embed src="<?php echo $file_path; ?>#view=FitH&scrollbar=1&toolbar=1" 
               type="application/pdf" 
               class="pdf-viewer">
        
        <!-- Способ 2: Iframe (запасной вариант) -->
        <iframe src="<?php echo $file_path; ?>#view=FitH" 
                class="pdf-viewer" 
                style="display: none;"></iframe>
        
        <script>
            // Проверяем, поддерживает ли браузер встроенный просмотр PDF
            // Если нет - показываем iframe с Google Docs Viewer
            if (!navigator.mimeTypes || !navigator.mimeTypes['application/pdf']) {
                document.querySelector('embed').style.display = 'none';
                document.querySelector('iframe').style.display = 'block';
                
                // Альтернатива: используем Google Docs Viewer
                // Раскомментируй если нужно
                // var pdfUrl = encodeURIComponent(window.location.origin + '/<?php echo $file_path; ?>');
                // document.querySelector('iframe').src = 'https://docs.google.com/viewer?url=' + pdfUrl + '&embedded=true';
            }
        </script>
    </body>
    </html>
    <?php
} else {
    header('HTTP/1.0 404 Not Found');
    echo "Файл не найден или не является PDF";
}
?>
