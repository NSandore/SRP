<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddTimestampsToScholarships extends Migration
{
    public function up()
    {
        Schema::table('scholarships', function (Blueprint $table) {
            $table->timestamps(); // Adds 'created_at' and 'updated_at'
        });
    }

    public function down()
    {
        Schema::table('scholarships', function (Blueprint $table) {
            $table->dropTimestamps();
        });
    }
}
