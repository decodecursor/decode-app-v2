"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface AITextLoadingProps {
    className?: string;
    interval?: number;
}

export default function AITextLoading({
    className = "",
    interval = 1500,
}: AITextLoadingProps) {
    const texts = [
        "Almost ready, darling…",
        "Assessing your glow…",
        "Sipping champagne…",
        "Pixels on private jet…",
        "Priming for perfection…",
        "Chauffeuring your glow…",
    ];

    const [currentText, setCurrentText] = useState(
        texts[Math.floor(Math.random() * texts.length)]
    );

    useEffect(() => {
        const pickRandom = () => {
            let next;
            do {
                next = texts[Math.floor(Math.random() * texts.length)];
            } while (next === currentText); // avoid repeating same text
            setCurrentText(next);
        };

        const timer = setInterval(() => {
            pickRandom();
        }, interval);

        return () => clearInterval(timer);
    }, [interval, currentText, texts]);

    return (
        <div className="flex items-center justify-center p-8 bg-white">
            <motion.div
                className="relative px-4 py-2 w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentText}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{
                            opacity: { duration: 0.3 },
                            y: { duration: 0.3 },
                        }}
                        className={`flex justify-center text-lg font-bold bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 bg-[length:200%_100%] bg-clip-text text-transparent animate-gradient-shift whitespace-nowrap min-w-max ${className}`}
                    >
                        {currentText}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
