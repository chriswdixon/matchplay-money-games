-- Fix search_path for validation functions to prevent security issues

-- Update validate_hole_pars function with fixed search_path
CREATE OR REPLACE FUNCTION validate_hole_pars()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if hole_pars is provided
  IF NEW.hole_pars IS NOT NULL THEN
    -- Validate that it's an object with exactly 18 entries
    IF jsonb_typeof(NEW.hole_pars) != 'object' THEN
      RAISE EXCEPTION 'hole_pars must be a JSON object';
    END IF;
    
    -- Check for exactly 18 holes
    IF (SELECT COUNT(*) FROM jsonb_object_keys(NEW.hole_pars)) != 18 THEN
      RAISE EXCEPTION 'hole_pars must contain exactly 18 holes';
    END IF;
    
    -- Validate each hole number (1-18) and par value (3-6)
    IF EXISTS (
      SELECT 1
      FROM jsonb_each_text(NEW.hole_pars) AS entry
      WHERE entry.key !~ '^(1[0-8]|[1-9])$'
         OR entry.value !~ '^\d+$'
         OR entry.value::integer < 3
         OR entry.value::integer > 6
    ) THEN
      RAISE EXCEPTION 'hole_pars must have holes 1-18 with par values between 3 and 6';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update validate_match_score_strokes function with fixed search_path
CREATE OR REPLACE FUNCTION validate_match_score_strokes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate strokes are within reasonable range (1-15)
  IF NEW.strokes IS NOT NULL AND (NEW.strokes < 1 OR NEW.strokes > 15) THEN
    RAISE EXCEPTION 'Strokes must be between 1 and 15';
  END IF;
  
  -- Validate hole number is between 1 and 18
  IF NEW.hole_number < 1 OR NEW.hole_number > 18 THEN
    RAISE EXCEPTION 'Hole number must be between 1 and 18';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update validate_final_scores function with fixed search_path
CREATE OR REPLACE FUNCTION validate_final_scores()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if final_scores is an object
  IF NEW.final_scores IS NOT NULL AND jsonb_typeof(NEW.final_scores) != 'object' THEN
    RAISE EXCEPTION 'final_scores must be a JSON object';
  END IF;
  
  -- Validate player count (1-8 players)
  IF (SELECT COUNT(*) FROM jsonb_object_keys(NEW.final_scores)) < 1 
     OR (SELECT COUNT(*) FROM jsonb_object_keys(NEW.final_scores)) > 8 THEN
    RAISE EXCEPTION 'final_scores must contain between 1 and 8 players';
  END IF;
  
  -- Validate each player entry has required fields and reasonable values
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.final_scores) AS player_entry
    WHERE (player_entry.value->>'gross_strokes')::integer < 18
       OR (player_entry.value->>'gross_strokes')::integer > 200
       OR (player_entry.value->>'net_strokes')::integer < -10
       OR (player_entry.value->>'net_strokes')::integer > 220
       OR (player_entry.value->>'handicap_index')::numeric < -10
       OR (player_entry.value->>'handicap_index')::numeric > 54
       OR length(player_entry.value->>'player_name') > 100
  ) THEN
    RAISE EXCEPTION 'final_scores contains invalid player data';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update validate_forfeited_players function with fixed search_path
CREATE OR REPLACE FUNCTION validate_forfeited_players()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if forfeited_players is an array
  IF NEW.forfeited_players IS NOT NULL AND jsonb_typeof(NEW.forfeited_players) != 'array' THEN
    RAISE EXCEPTION 'forfeited_players must be a JSON array';
  END IF;
  
  -- Validate array size (max 8 players)
  IF jsonb_array_length(NEW.forfeited_players) > 8 THEN
    RAISE EXCEPTION 'forfeited_players cannot have more than 8 entries';
  END IF;
  
  -- Validate each entry has required fields
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.forfeited_players) AS entry
    WHERE NOT (entry ? 'user_id' AND entry ? 'reason' AND entry ? 'timestamp')
       OR length(entry->>'reason') > 200
  ) THEN
    RAISE EXCEPTION 'forfeited_players entries must have user_id, reason, and timestamp';
  END IF;
  
  RETURN NEW;
END;
$$;