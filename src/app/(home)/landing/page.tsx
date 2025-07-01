"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";

export default function LandingPage() {
//   const { data: session, status } = useSession();
  const router = useRouter();

//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push("/");
//     }
//   }, [status, router]);

//   if (status === "loading") {
//     return (
//       <div className="flex h-screen items-center justify-center">
//         <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
//       </div>
//     );
//   }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to AI Interview Platform</h1>
          <p className="text-xl text-gray-600">Prepare for your next interview with our AI-powered platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Start New Interview</CardTitle>
              <CardDescription>Begin a new AI-powered interview session</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => router.push("/interview/new")}
              >
                Start Interview
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Previous Sessions</CardTitle>
              <CardDescription>Review your past interview sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => router.push("/interview/history")}
              >
                View History
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your account and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => router.push("/profile")}
              >
                Manage Profile
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Need help? Check out our{" "}
            <button 
              onClick={() => router.push("/help")}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              documentation
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
