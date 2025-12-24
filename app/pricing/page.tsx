import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function PricingPage() {
    const tiers = [
        {
            name: "Free",
            price: "0€",
            description: "Idéal pour découvrir l'analyse de sentiment par IA.",
            features: [
                "10 requêtes d'analyse / jour",
                "Historique de 7 jours",
                "Modèle IA standard",
                "Support communautaire",
            ],
            cta: "Commencer gratuitement",
            href: "/sign-up",
            variant: "outline" as const,
        },
        {
            name: "Pro",
            price: "9€",
            period: "/mois",
            description: "Pour les traders sérieux qui veulent un avantage compétitif.",
            features: [
                "500 requêtes d'analyse / jour",
                "Historique illimité",
                "Modèle IA Premium (GPT-4o)",
                "Export de données (CSV/JSON)",
                "Support prioritaire 24/7",
                "Alertes temps réel",
            ],
            cta: "Passer à Pro",
            href: "/sign-up",
            variant: "default" as const,
            popular: true,
        },
    ];

    return (
        <div className="py-20 px-4">
            <div className="max-w-5xl mx-auto text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
                    Un plan adapté à vos <span className="text-blue-500">ambitions</span>
                </h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    Accédez à la puissance de l'IA pour décrypter les marchés financiers.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {tiers.map((tier) => (
                    <Card key={tier.name} className={`relative flex flex-col bg-slate-900 border-slate-800 ${tier.popular ? 'ring-2 ring-blue-500 border-transparent' : ''}`}>
                        {tier.popular && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-600 text-white">
                                Plus populaire
                            </Badge>
                        )}
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold text-white">{tier.name}</CardTitle>
                            <CardDescription className="text-slate-400">{tier.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <div className="mb-6">
                                <span className="text-4xl font-bold text-white">{tier.price}</span>
                                {tier.period && <span className="text-slate-400 text-lg">{tier.period}</span>}
                            </div>
                            <ul className="space-y-4">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3 text-slate-300">
                                        <Check className="w-5 h-5 text-blue-500 shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button asChild variant={tier.variant} className="w-full py-6 text-lg cursor-pointer">
                                <Link href={tier.href}>{tier.cta}</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <div className="max-w-3xl mx-auto mt-20 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Info className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-bold text-white">Transparence sur l'IA</h3>
                </div>
                <p className="text-slate-400 leading-relaxed italic">
                    StockIA utilise l'IA pour analyser les actualités. Les résultats sont fournis à titre indicatif et ne constituent pas des conseils en investissement.
                </p>
            </div>
        </div>
    );
}