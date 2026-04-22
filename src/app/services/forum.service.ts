import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Post, Comment, Notification } from './forum.models';

@Injectable({ providedIn: 'root' })
export class ForumService {
  private readonly API_POSTS = `${environment.apiUrl}/api/posts`;
  private readonly API_COMMENTS = `${environment.apiUrl}/api`; // base for /comments & /posts/{id}/comments

  constructor(private http: HttpClient) {}

  // ─── POSTS ───
  getAllPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(this.API_POSTS);
  }

  getPostById(id: number): Observable<Post> {
    return this.http.get<Post>(`${this.API_POSTS}/${id}`);
  }

  createPost(post: Partial<Post>): Observable<Post> {
    return this.http.post<Post>(this.API_POSTS, post);
  }

  updatePost(id: number, post: Partial<Post>): Observable<Post> {
    return this.http.put<Post>(`${this.API_POSTS}/${id}`, post);
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_POSTS}/${id}`);
  }

  likePost(id: number): Observable<Post> {
    return this.http.put<Post>(`${this.API_POSTS}/${id}/like`, {});
  }

  // ─── COMMENTS ───
  getCommentsByPost(postId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.API_COMMENTS}/posts/${postId}/comments`);
  }

  getCommentById(id: number): Observable<Comment> {
    return this.http.get<Comment>(`${this.API_COMMENTS}/comments/${id}`);
  }

  createComment(postId: number, comment: Partial<Comment>): Observable<Comment> {
    return this.http.post<Comment>(`${this.API_COMMENTS}/posts/${postId}/comments`, comment);
  }

  updateComment(id: number, comment: Partial<Comment>): Observable<Comment> {
    return this.http.put<Comment>(`${this.API_COMMENTS}/comments/${id}`, comment);
  }

  deleteComment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_COMMENTS}/comments/${id}`);
  }

  likeComment(id: number): Observable<Comment> {
    return this.http.put<Comment>(`${this.API_COMMENTS}/comments/${id}/like`, {});
  }

  // ─── NOTIFICATIONS ───
  private readonly API_NOTIFICATIONS = `${environment.apiUrl}/api/notifications`;

  getUnreadNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.API_NOTIFICATIONS}/unread`);
  }

  getNotificationCount(): Observable<number> {
    return this.http.get<number>(`${this.API_NOTIFICATIONS}/count`);
  }

  markNotificationAsRead(id: number): Observable<Notification> {
    return this.http.put<Notification>(`${this.API_NOTIFICATIONS}/${id}/read`, {});
  }
}
