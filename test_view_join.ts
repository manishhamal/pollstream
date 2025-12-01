
import { supabase } from './services/supabase';

async function testViewJoin() {
    console.log('Testing view join...');
    const { data, error } = await supabase
        .from('polls_with_creator')
        .select(`
      *,
      options (
        id,
        text
      )
    `)
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success:', data);
    }
}

testViewJoin();
