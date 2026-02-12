import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, GalleryVerticalEnd } from "lucide-react";
import { Controller } from "react-hook-form";
import useLogin from "./useLogin";

const Login = () => {
  const { form, isLoading, onSubmit, showPassword, setShowPassword } =
    useLogin();
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Dapur Cokelat.
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className={cn("flex flex-col gap-6")}
            >
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Login to your account</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Enter your email below to login to your account
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Controller
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          {...field}
                          placeholder="m@example.com"
                          type="email"
                          aria-invalid={!!fieldState.error}
                        />
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    {/* <a
                      href="#"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a> */}
                  </div>
                  <Controller
                    control={form.control}
                    name="password"
                    render={({ field, fieldState }) => (
                      <>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            aria-invalid={!!fieldState.error}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </Field>
                <Field>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="cursor-pointer hover:bg-white hover:text-black"
                  >
                    Login
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/dapur.webp"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
};

export default Login;
