<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Import Controllers
use App\Http\Controllers\ScholarshipController;
use App\Http\Controllers\ForumController;
use App\Http\Controllers\UserController;

// Test Route
Route::get('/test', function () {
    return response()->json(['message' => 'API test route reached.']);
});

// Scholarship Routes
Route::get('/scholarships/featured', [ScholarshipController::class, 'featured']);

// Forum Routes
Route::get('/forums/popular', [ForumController::class, 'popular']);

// User Routes (Requires Authentication)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/users/followed-schools', [UserController::class, 'getFollowedSchools']);
});
