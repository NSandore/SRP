<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Scholarship extends Model
{
    protected $table = 'scholarships';
    protected $primaryKey = 'scholarship_id';

    // Allow automatic handling of timestamps
    public $timestamps = true;

    // Define fillable fields
    protected $fillable = [
        'university_id',
        'title',
        'description',
        'eligibility',
        'deadline',
        'link',
        'verified_by',
        'verified_at',
    ];
}
