<?php

namespace App\Http\Controllers;

use App\Models\Scholarship;
use Illuminate\Http\JsonResponse;

class ScholarshipController extends Controller
{
    public function featured()
    {
        try {
            $scholarships = Scholarship::orderBy('deadline', 'asc')->take(5)->get();
            return response()->json($scholarships);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
