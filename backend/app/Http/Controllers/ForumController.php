<?php

// app/Http/Controllers/ForumController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ForumPost;

class ForumController extends Controller
{
    public function popular()
    {
        $posts = ForumPost::orderBy('upvotes', 'desc')->take(5)->get();
        return response()->json($posts);
    }
}
