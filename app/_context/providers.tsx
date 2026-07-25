"use client";

import type { PropsWithChildren } from "react";
import Providers from "../_components/providers";

export default function ContextProviders({ children }: PropsWithChildren) {
	return <Providers>{children}</Providers>;
}
