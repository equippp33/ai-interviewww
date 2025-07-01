"use client";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

interface SignUpFormValues {
  name: string;
  email: string;
  password: string;
}

export default function Login() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: {errors},
  } = useForm<SignUpFormValues>();

  const { mutate, isPending } = api.user.registerUser.useMutation({
    onSuccess: () => {
      alert("Account Created");
      router.push("/taskmanage");
    },
  });

  const onSubmit = (data: SignUpFormValues) => {
    mutate(data);
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-semibold text-gray-700">Sign Up</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <input
              type="text"
              {...register("name")}
              placeholder="Full Name"
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring"
              required
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <input
              type="email"
              {...register("email")}
              placeholder="Email"
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring"
              required
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <input
              type="password"
              {...register("password")}
              placeholder="Password"
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring"
              required
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-red-800 px-4 py-2 text-white transition-all hover:bg-black disabled:bg-gray-400"
            disabled={isPending}
          >
            {isPending ? "Submitting..." : "Sign Up"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <span
            className="cursor-pointer text-blue-500 hover:underline"
            onClick={() => router.push("/")}
          >
            Log in
          </span>
        </div>
      </div>
    </div>
  );
}
