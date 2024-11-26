<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ScholarshipController;
use App\Http\Controllers\ForumController;
use App\Http\Controllers\UserController;

Route::get('/scholarships/featured', [ScholarshipController::class, 'featured']);
Route::get('/forums/popular', [ForumController::class, 'popular']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/users/followed-schools', [UserController::class, 'getFollowedSchools']);
});
