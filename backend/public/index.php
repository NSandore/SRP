<?php
//require __DIR__.'/../vendor/autoload.php';

// Debugging entry point
//echo "Reached Laravel entry point."; 
//exit;

/*
|--------------------------------------------------------------------------
| Run The Application
|--------------------------------------------------------------------------
|
| Once we have the application, we can handle the incoming request using
| the application's HTTP kernel. Then, we will send the response back
| to this client's browser, allowing them to enjoy our application.
|
*/

//$app = require_once __DIR__.'/../bootstrap/app.php';

//$kernel = $app->make(Kernel::class);

//$response = $kernel->handle(
//    $request = Request::capture()
//)->send();

//$kernel->terminate($request, $response);


/**
 * Laravel - A PHP Framework For Web Artisans
 *
 * @package  Laravel
 * @author   Taylor Otwell
 */

define('LARAVEL_START', microtime(true));

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);

$response->send();

$kernel->terminate($request, $response);

