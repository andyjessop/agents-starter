import type { ComponentType } from "react";
import type { RouteName } from "typed-redux-router";

import {
  CheckEmailPage,
  CreateAccountPage,
  ResetPasswordPage,
  SignInPage,
} from "./modules/auth/react.tsx";
import { HomePage } from "./modules/home/react.tsx";
import { OutcomePanel } from "./modules/navigation/react.tsx";
import type { AppRoutes } from "./router.ts";

const unresolved = OutcomePanel;

export const pages = {
  entry: unresolved,
  home: HomePage,
  signIn: SignInPage,
  createAccount: CreateAccountPage,
  checkEmail: CheckEmailPage,
  resetPassword: ResetPasswordPage,
  notFound: unresolved,
} satisfies Record<RouteName<AppRoutes>, ComponentType>;
