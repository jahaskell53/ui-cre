import { LoginForm } from "./login-form";

function getDevLoginDefaults() {
    if (process.env.NODE_ENV !== "development") {
        return { email: "", password: "" };
    }
    return {
        email: process.env.TEST_EMAIL ?? "",
        password: process.env.TEST_PASSWORD ?? "",
    };
}

export default function LoginPage() {
    const { email, password } = getDevLoginDefaults();

    return <LoginForm initialEmail={email} initialPassword={password} />;
}
