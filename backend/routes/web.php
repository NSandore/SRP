<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
   return 'Welcome to Laravel!';
});

Route::get('/test', function () {
   return 'This is a test route!';
});

Route::get('/hello', function () {
   return 'Hello, Laravel!';
});
