<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class MakeUniversityIdNullableInScholarships extends Migration
{
    public function up()
    {
        Schema::table('scholarships', function (Blueprint $table) {
            $table->unsignedBigInteger('university_id')->nullable()->change();
        });
    }

    public function down()
    {
        Schema::table('scholarships', function (Blueprint $table) {
            $table->unsignedBigInteger('university_id')->nullable(false)->change();
        });
    }
}
