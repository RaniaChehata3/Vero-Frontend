import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ForumService } from '../../../services/forum.service';
import { Post, Comment } from '../../../services/forum.models';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.css'
})
export class ThreadComponent implements OnInit {
  postId?: number;
  post?: Post;
  comments: Comment[] = [];
  
  loading = true;
  isLoggedIn = false;
  currentUserEmail: string | null = null;
  
  editingCommentId: number | null = null;
  editCommentContent = '';
  
  editingPost: boolean = false;
  editPostContent = '';
  
  newCommentContent = '';
  toxicError = '';
  submitting = false;

  constructor(
    private route: ActivatedRoute,
    private forumService: ForumService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn;
    this.currentUserEmail = this.authService.currentUserEmail;
    this.route.params.subscribe(params => {
      this.postId = +params['id'];
      this.loadThread();
    });
  }

  loadThread() {
    if (!this.postId) return;
    this.loading = true;
    
    // Load Post
    this.forumService.getPostById(this.postId).subscribe(p => {
      this.ngZone.run(() => {
        this.post = p;
        this.loading = false;
        this.cdr.markForCheck();
      });
    });

    // Load Comments
    this.loadComments();
  }

  loadComments() {
    if(!this.postId) return;
    this.forumService.getCommentsByPost(this.postId).subscribe(c => {
      this.ngZone.run(() => {
        this.comments = c.sort((a,b) => new Date(a.createdAt||'').getTime() - new Date(b.createdAt||'').getTime());
        this.cdr.markForCheck();
      });
    });
  }

  submitComment() {
    this.toxicError = '';
    if(!this.newCommentContent.trim() || !this.postId) return;
    
    this.submitting = true;
    
    this.forumService.createComment(this.postId, { content: this.newCommentContent }).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.newCommentContent = '';
          this.submitting = false;
          this.loadComments();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.submitting = false;
          if(err.error && typeof err.error === 'string' && err.error.includes('bloqu\u00e9')) {
            this.toxicError = err.error;
          } else {
            this.toxicError = 'An error occurred while posting your comment.';
          }
          this.cdr.markForCheck();
        });
      }
    });
  }

  likePost() {
    if(!this.postId || !this.isLoggedIn) return;
    this.forumService.likePost(this.postId).subscribe(p => {
      if(this.post) this.post.likes = p.likes;
    });
  }

  likeComment(commentId?: number) {
    if(!commentId || !this.isLoggedIn) return;
    this.forumService.likeComment(commentId).subscribe(() => this.loadComments());
  }

  deleteComment(id: number, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this comment?')) return;
    this.forumService.deleteComment(id).subscribe(() => this.loadComments());
  }

  startEditComment(c: Comment, event: Event) {
    event.stopPropagation();
    this.editingCommentId = c.id!;
    this.editCommentContent = c.content;
  }

  saveEditComment(c: Comment, event: Event) {
    event.stopPropagation();
    if (!this.editCommentContent.trim()) return;
    this.forumService.updateComment(c.id!, { ...c, content: this.editCommentContent }).subscribe(() => {
      this.editingCommentId = null;
      this.loadComments();
    });
  }

  formatDate(d?: string) {
    if(!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
