<?php
// app/Http/Controllers/ScholarshipController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Scholarship;

class ScholarshipController extends Controller
{
    public function featured()
    {
        $scholarships = Scholarship::orderBy('created_at', 'desc')->take(5)->get();
        return response()->json($scholarships);
    }
}
