import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side validation schema matching client
const validateUserInput = (data: any) => {
  const errors: string[] = [];
  
  // Email validation
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else {
    const email = data.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Format d\'email invalide');
    }
    if (email.length > 255) {
      errors.push('L\'email doit contenir moins de 255 caractères');
    }
  }
  
  // Password validation
  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  } else {
    if (data.password.length < 8) {
      errors.push('Le mot de passe doit contenir au moins 8 caractères');
    }
    if (!/[A-Z]/.test(data.password)) {
      errors.push('Le mot de passe doit contenir au moins une lettre majuscule');
    }
    if (!/[a-z]/.test(data.password)) {
      errors.push('Le mot de passe doit contenir au moins une lettre minuscule');
    }
    if (!/[0-9]/.test(data.password)) {
      errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    if (!/[!@#$%^&*()_+\-=\x5b\]{};':"\\|,.<>\x2f?]/.test(data.password)) {
      errors.push('Le mot de passe doit contenir au moins un caractère spécial');
    }
  }
  
  // Full name validation
  if (!data.full_name || typeof data.full_name !== 'string') {
    errors.push('Full name is required');
  } else {
    const fullName = data.full_name.trim();
    if (fullName.length < 1) {
      errors.push('Le nom complet est requis');
    }
    if (fullName.length > 100) {
      errors.push('Le nom doit contenir moins de 100 caractères');
    }
  }
  
  // Role validation
  const validRoles = ['admin', 'moderator', 'user'];
  if (!data.role || !validRoles.includes(data.role)) {
    errors.push('Rôle invalide');
  }
  
  return { isValid: errors.length === 0, errors };
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the request is from an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify admin status
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Check if user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || roleData.role !== 'admin') {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Accès réservé aux administrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = validateUserInput(body);
    
    if (!validation.isValid) {
      console.error('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: validation.errors[0] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create the user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name.trim()
      }
    });

    if (authError) {
      console.error('User creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      console.error('No user data returned');
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de l\'utilisateur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: body.email.trim(),
        full_name: body.full_name.trim()
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Try to delete the user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: body.role
      });

    if (roleInsertError) {
      console.error('Role creation error:', roleInsertError);
      // Try to delete the user if role creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: roleInsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', authData.user.id);
    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: body.full_name.trim()
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in admin-create-user:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur interne' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
