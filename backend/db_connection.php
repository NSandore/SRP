<?php
function getDB() {
    static $db = null;
    if ($db === null) {
        $host = 'localhost';
        $dbname = 'srp_db';
        $user = 'srp_user';
        $pass = 'Silvia317*';

        $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ];

        $db = new PDO($dsn, $user, $pass, $options);
    }
    return $db;
}
?>
