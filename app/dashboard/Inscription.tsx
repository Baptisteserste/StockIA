import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">StockIA</h1>
                    <p className="text-slate-300">Créez votre compte</p>
                </div>
                <SignUp
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "bg-white shadow-2xl"
                        }
                    }}
                    fallbackRedirectUrl="/dashboard"
                    signInUrl="/sign-in"
                />
            </div>
        </div>
    )
}