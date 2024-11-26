<?php
// app/Http/Controllers/UserController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;

class UserController extends Controller
{
    public function getFollowedSchools(Request $request)
    {
        $user = $request->user();
        $schools = $user->followedSchools; // Assuming a relationship is defined
        return response()->json($schools);
    }
}
