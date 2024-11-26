<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Render an exception into an HTTP response.
     */
    public function render($request, Throwable $exception)
    {
        // Check if the request is an API request
        if ($request->is('api/*')) {
            // Handle specific exceptions for better API responses
            if ($exception instanceof ModelNotFoundException) {
                return response()->json([
                    'error' => 'Resource not found.',
                ], 404);
            }

            if ($exception instanceof NotFoundHttpException) {
                return response()->json([
                    'error' => 'Endpoint not found.',
                ], 404);
            }

            if ($exception instanceof MethodNotAllowedHttpException) {
                return response()->json([
                    'error' => 'HTTP method not allowed for this endpoint.',
                ], 405);
            }

            if ($exception instanceof HttpException) {
                return response()->json([
                    'error' => $exception->getMessage(),
                ], $exception->getStatusCode());
            }

            // Fallback for all other exceptions
            return response()->json([
                'error' => $exception->getMessage(),
            ], $exception->getCode() ?: 500);
        }

        // Default rendering for web requests
        return parent::render($request, $exception);
    }
}
