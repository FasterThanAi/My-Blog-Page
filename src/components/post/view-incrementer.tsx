"use client";

import * as React from "react";
import { incrementPostViewAction } from "@/app/actions/public-posts";

interface ViewIncrementerProps {
  postId: string;
}

export function ViewIncrementer({ postId }: ViewIncrementerProps) {
  React.useEffect(() => {
    incrementPostViewAction({ postId }).catch(() => {
      // Fail silently
    });
  }, [postId]);

  return null;
}
