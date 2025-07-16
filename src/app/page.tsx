"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { api } from "@/trpc/react";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

interface SignUpFormValues {
  email: string;
  password: string;
}

export default function Login() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<null | { id: string }>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const {
    data: applications,
    isLoading: isAppLoading,
    refetch: refetchApplications,
  } = api.interview.getCandidateApplicationsByUser.useQuery(
    pendingUser ? { candidateId: pendingUser.id } : { candidateId: "" },
    { enabled: false }
  );

  useEffect(() => {
    if (pendingUser && pendingSessionId) {
      refetchApplications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUser, pendingSessionId]);

  useEffect(() => {
    if (applications && applications.length > 0 && pendingUser && pendingSessionId) {
      const app = applications[0];
      if (app && app.jobId && app.id) {
        router.push(`/interview/${app.jobId}/${app.id}/${pendingSessionId}`);
      } else {
        setAppError("Application data is incomplete.");
      }
    } else if (applications && applications.length === 0 && pendingUser && pendingSessionId) {
      setAppError("No candidate application found for this user.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, pendingUser, pendingSessionId]);

  const { mutate, isPending } = api.user.login.useMutation({
    onSuccess: ({ user }) => {
      if (user) {
        if (user.role === "admin") {
          router.push("/landing");
        } else {
          setAppError(null);
          const sessionId = uuidv4();
          setPendingUser({ id: user.id });
          setPendingSessionId(sessionId);
        }
      }
    },
    onError: (error) => {
      setLoginError(error.message);
    },
  });

  const onSubmit = (data: SignUpFormValues) => {
    setLoginError(null);
    mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526]">
      <div className="w-full max-w-md bg-white/90 rounded-2xl shadow-2xl p-10 border border-gray-200 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-tr from-blue-700 to-purple-600 rounded-full p-3 mb-2 shadow-lg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-white"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.41 2.87 8.19 6.84 9.5.5.09.66-.22.66-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85.004 1.71.12 2.51.35 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85 0 1.33-.01 2.4-.01 2.73 0 .27.16.58.67.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" fill="currentColor"/></svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight mb-1">AI Interview Bot</h1>
          <p className="text-gray-500 text-sm">Sign in to your interview workspace</p>
        </div>
        {loginError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {loginError}
          </div>
        )}
        {appError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {appError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              {...register("email", { 
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address"
                }
              })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 text-gray-900"
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                {...register("password", { 
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters"
                  }
                })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 text-gray-900 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="currentColor"/><circle cx="12" cy="12" r="2.5" fill="#fff"/></svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M1 1l22 22M4.22 4.22A9.77 9.77 0 0 0 2 12s3 7 10 7c2.01 0 3.77-.37 5.22-1.01M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-5.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-700 to-purple-600 hover:from-purple-600 hover:to-blue-700 transition text-white py-2 rounded-lg font-semibold shadow-md flex items-center justify-center gap-2"
            disabled={isPending || isAppLoading}
          >
            {(isPending || isAppLoading) ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> 
                Signing In...
              </span>
            ) : (
              <>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path d="M16 17l5-5m0 0l-5-5m5 5H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign In
              </>
            )}
          </button>
        </form>
        <div className="mt-8 text-center text-gray-500 text-xs">
          <span>New to AI Interview Bot?</span>
          <button
            className="ml-2 text-blue-700 hover:underline font-medium"
            onClick={() => router.push("/auth/signup")}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}