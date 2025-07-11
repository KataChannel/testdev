import { NextRequest, NextResponse } from 'next/server';

const FACEBOOK_PAGE_ID = process.env.NEXT_PUBLIC_FACEBOOK_PAGE_ID;
const FACEBOOK_ACCESS_TOKEN = process.env.NEXT_PUBLIC_FACEBOOK_ACCESS_TOKEN;
const FACEBOOK_API_VERSION = process.env.NEXT_PUBLIC_FACEBOOK_API_VERSION || 'v18.0';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const postId = searchParams.get('postId');

        // Check if credentials are configured
        const hasCredentials = FACEBOOK_PAGE_ID && FACEBOOK_ACCESS_TOKEN;
        
        if (!hasCredentials) {
            console.log('Facebook credentials not configured');
            return NextResponse.json({ 
                data: [], 
                message: 'Facebook API credentials not configured. No data available.',
                status: 'no_credentials'
            });
        }

        // Real Facebook API calls when credentials are available
        if (type === 'posts') {
            try {
                const response = await fetch(
                    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${FACEBOOK_PAGE_ID}/posts?` +
                    new URLSearchParams({
                        fields: 'id,message,created_time,likes.summary(true),comments.summary(true),shares',
                        access_token: FACEBOOK_ACCESS_TOKEN!,
                    })
                );

                if (!response.ok) {
                    console.log(`Facebook API error: ${response.status}`);
                    return NextResponse.json({ 
                        data: [], 
                        message: 'Unable to fetch posts from Facebook. No information available.',
                        status: 'api_error',
                        error_code: response.status
                    });
                }

                const data = await response.json();
                console.log('Fetched posts from Facebook API:', data);
                
                return NextResponse.json(data);
            } catch (error) {
                console.log('Facebook API error:', error);
                return NextResponse.json({ 
                    data: [], 
                    message: 'Failed to connect to Facebook API. No posts information available.',
                    status: 'connection_error'
                });
            }
        }

        if (type === 'comments') {
            if (!postId) {
                return NextResponse.json(
                    { error: 'postId is required for comments' },
                    { status: 400 }
                );
            }

            try {
                const response = await fetch(
                    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${postId}/comments?` +
                    new URLSearchParams({
                        fields: 'id,from,message,created_time,likes.summary(true)',
                        access_token: FACEBOOK_ACCESS_TOKEN!,
                    })
                );

                if (!response.ok) {
                    console.log(`Facebook API error: ${response.status}`);
                    return NextResponse.json({ 
                        data: [], 
                        message: 'Unable to fetch comments from Facebook. No information available.',
                        status: 'api_error',
                        error_code: response.status
                    });
                }

                const data = await response.json();
                return NextResponse.json(data);
            } catch (error) {
                console.log('Facebook API error:', error);
                return NextResponse.json({ 
                    data: [], 
                    message: 'Failed to connect to Facebook API. No comments information available.',
                    status: 'connection_error'
                });
            }
        }

        if (type === 'messages') {
            try {
                const response = await fetch(
                    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${FACEBOOK_PAGE_ID}/conversations?` +
                    new URLSearchParams({
                        fields: 'id,participants,messages{message,from,created_time}',
                        // fields: 'id,participants,messages{message,from,created_time}',
                        access_token: FACEBOOK_ACCESS_TOKEN!,
                    })
                );

                if (!response.ok) {
                    console.log(`Facebook API error: ${response.status}`);
                    return NextResponse.json({ 
                        data: [], 
                        message: 'Unable to fetch messages from Facebook. No information available.',
                        status: 'api_error',
                        error_code: response.status
                    });
                }

                const data = await response.json();                
                return NextResponse.json(data);
            } catch (error) {
                console.log('Facebook API error:', error);
                return NextResponse.json({ 
                    data: [], 
                    message: 'Failed to connect to Facebook API. No messages information available.',
                    status: 'connection_error'
                });
            }
        }

        return NextResponse.json(
            { error: 'Invalid type parameter. Use: posts, comments, or messages' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Facebook API Error:', error);
        
        return NextResponse.json({ 
            data: [],
            message: 'Facebook API service unavailable. No information available at this time.',
            status: 'service_unavailable',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
